import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { Role, UserStatus } from '../common/enums';
import { paginate, type Paginated } from '../common/pagination';
import { User } from '../database/entities';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  toAuditSnapshot,
  toUserResponse,
  type UserResponse,
} from './user.mapper';

/** What an edit is trying to do to an account, for FR-USR-03's tests. */
type Intent = { disabling: boolean; demoting: boolean; deleting: boolean };

/** Module 9 (SRS §4.9). Staff accounts and roles; admin only. */
@Injectable()
export class UsersAdminService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  /** FR-USR-01 */
  async findAll(query: ListUsersDto): Promise<Paginated<UserResponse>> {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    // Search spans two columns, so it becomes two OR'd wheres rather than one
    // object — each still carrying the role and status narrowing.
    const [rows, total] = await this.users.findAndCount({
      where: query.search
        ? [
            { ...where, name: ILike(`%${query.search}%`) },
            { ...where, email: ILike(`%${query.search}%`) },
          ]
        : where,
      order: { [query.sort]: query.dir === 'asc' ? 'ASC' : 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.page_size,
      take: query.page_size,
    });

    return paginate(
      rows.map(toUserResponse),
      total,
      query.page,
      query.page_size,
    );
  }

  async findOne(id: number): Promise<UserResponse> {
    return toUserResponse(await this.loadOrFail(id));
  }

  /** FR-USR-01 / FR-USR-02-v2 */
  async create(
    dto: CreateUserDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<UserResponse> {
    await this.assertEmailFree(dto.email);

    const saved = await this.users.save(
      this.users.create({
        name: dto.name,
        email: dto.email,
        // The plain password never leaves this line — not to a variable that
        // outlives it, not to a log, and never to a response (FR-USR-02-v2).
        password_hash: await this.passwords.hash(dto.password),
        role: dto.role,
        status: dto.status ?? UserStatus.active,
      }),
    );

    const response = toUserResponse(saved);

    await this.audit.record({
      actor_id: actor.id,
      entity: 'user',
      entity_id: String(saved.id),
      action: 'create',
      after: toAuditSnapshot(response),
      ip,
    });

    return response;
  }

  /** FR-USR-01 / FR-USR-02-v2 / FR-USR-03 */
  async update(
    id: number,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<UserResponse> {
    const target = await this.loadOrFail(id);
    const before = toUserResponse(target);

    await this.assertAllowed(target, actor, {
      disabling:
        dto.status === UserStatus.disabled &&
        target.status !== UserStatus.disabled,
      demoting: dto.role === Role.operator && target.role === Role.admin,
      deleting: false,
    });

    if (dto.email && dto.email !== target.email) {
      await this.assertEmailFree(dto.email, id);
    }

    await this.users.update(
      { id },
      {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        status: dto.status,
        // Omitted leaves the existing hash alone; TypeORM skips `undefined`.
        ...(dto.password
          ? { password_hash: await this.passwords.hash(dto.password) }
          : {}),
      },
    );

    const response = toUserResponse(await this.loadOrFail(id));

    await this.audit.record({
      actor_id: actor.id,
      entity: 'user',
      entity_id: String(id),
      // A forced reset is worth naming in the log even though the hash itself
      // never appears in the before/after snapshot.
      action: dto.password ? 'update_with_password_reset' : 'update',
      before: toAuditSnapshot(before),
      after: toAuditSnapshot(response),
      ip,
    });

    return response;
  }

  /** FR-USR-01 / FR-USR-03. Soft delete: the account is recoverable, and its
   *  audit trail and recorded payments keep pointing at a row that exists. */
  async remove(
    id: number,
    actor: AuthenticatedUser,
    ip?: string,
  ): Promise<void> {
    const target = await this.loadOrFail(id);

    await this.assertAllowed(target, actor, {
      disabling: false,
      demoting: false,
      deleting: true,
    });

    await this.users.softDelete({ id });

    await this.audit.record({
      actor_id: actor.id,
      entity: 'user',
      entity_id: String(id),
      action: 'delete',
      before: toAuditSnapshot(toUserResponse(target)),
      ip,
    });
  }

  // --------------------------------------------------------- guards --

  /**
   * FR-USR-03, both halves.
   *
   * **Yourself.** An admin cannot disable, demote or delete their own account.
   * Not because it would break anything structurally, but because it is always
   * a mistake: the person doing it loses the ability to undo it.
   *
   * **The last admin.** The final *active* admin cannot be disabled, demoted or
   * deleted by anyone, including another admin. The clause names disabling and
   * demoting; deleting is included because it is strictly worse — the outcome
   * either way is a system nobody can administer, and it cannot be repaired
   * through the application.
   *
   * "Active" is the right count: a disabled admin cannot log in to fix
   * anything, so they do not keep the door open.
   */
  private async assertAllowed(
    target: User,
    actor: AuthenticatedUser,
    intent: Intent,
  ): Promise<void> {
    const verb = intent.deleting
      ? 'delete'
      : intent.disabling
        ? 'disable'
        : intent.demoting
          ? 'demote'
          : null;

    if (verb === null) return;

    if (target.id === actor.id) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `You cannot ${verb} your own account. Ask another admin to do it.`,
      });
    }

    if (target.role !== Role.admin || target.status !== UserStatus.active) {
      return;
    }

    const otherActiveAdmins = await this.users.countBy({
      role: Role.admin,
      status: UserStatus.active,
      id: Not(target.id),
    });

    if (otherActiveAdmins === 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `${target.name} is the only active admin, so they cannot be ${verb}d. Promote another admin first.`,
      });
    }
  }

  /**
   * The partial unique index only covers live rows, so a soft-deleted account
   * releases its address. Checking here turns what would be a 500 from the
   * index into a 400 naming the field; the index remains the real guard
   * against a race between two simultaneous creates.
   */
  private async assertEmailFree(
    email: string,
    exceptId?: number,
  ): Promise<void> {
    const taken = await this.users.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!taken || taken.id === exceptId) return;

    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: `"${email}" is already in use by another account`,
      field_errors: { email: 'This address is already registered' },
    });
  }

  private async loadOrFail(id: number): Promise<User> {
    const user = await this.users.findOne({ where: { id } });

    if (!user) throw new NotFoundException(`User ${id} not found`);

    return user;
  }
}
