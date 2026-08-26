/**
 * The shared formula package (SRS §2.5): every derived money figure is computed
 * here, once, so the API and the browser preview cannot drift apart.
 *
 * Deliberately free of Nest, TypeORM and every other runtime dependency — it is
 * plain TypeScript so the frontend can import the same source when Module 4's
 * live preview is built.
 */
export * from './money';
export * from './dates';
export * from './contract';
