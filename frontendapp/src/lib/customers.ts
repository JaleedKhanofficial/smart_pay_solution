import { apiRepository } from "@/api/api.repository";
import type { Customer } from "@/types/customer";

export function getCustomers(): Promise<Customer[]> {
    return apiRepository.get<Customer[]>("/customers");
}

export function getCustomer(id: string): Promise<Customer> {
    return apiRepository.get<Customer>(`/customers/${id}`);
}
