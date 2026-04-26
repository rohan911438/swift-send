// Re-export from `src/utils/index.ts` so existing components and tests can
// continue to import from `@/lib/utils` (the path that's referenced from
// over a dozen files across the codebase). The implementations live in
// `src/utils` and are kept there to avoid breaking other call sites.
export { cn } from '@/utils';
