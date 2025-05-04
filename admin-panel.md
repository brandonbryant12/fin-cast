
## Admin Feature Implementation Plan (v2 - Stub Pages)

This plan outlines the steps to implement the core administrator section, including authentication, authorization, routing, and sidebar navigation. The individual admin sub-pages (`App`, `Users`, `Reviews`, `Prompts`) will be created as simple placeholder "stub" pages.

**1. Admin Authentication & Authorization (Core Setup)** (COMPLETE)

* **Requirement:** Restrict access to admin features to designated admin users only. Ensure backend endpoints for potential future admin actions are protected.
* **Implementation:**
    * **Database (`@repo/db`):**
        * Add a boolean `isAdmin` field to the `user` schema (`packages/db/src/schemas/auth.ts`).
            ```typescript
            // packages/db/src/schemas/auth.ts
            import { sql } from 'drizzle-orm';
            import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

            export const users = pgTable('user', {
              id: text('id').primaryKey(),
              email: text('email').unique(),
              emailVerified: timestamp('emailVerified', { mode: 'date' }),
              name: text('name'),
              image: text('image'),
              // --- Add this line ---
              isAdmin: boolean('is_admin').default(false).notNull(),
              // --------------------
            });

            // ... rest of the schema (accounts, sessions, verificationTokens)
            ```
    * **Backend (TRPC - `@repo/api`):**
        * **Context Enhancement:** Modify TRPC context creation (`packages/api/src/server/trpc.ts`) to fetch the user from the database using the session and include the `isAdmin` status in the context (`ctx`).
            ```typescript
            // packages/api/src/server/trpc.ts (Conceptual Example)
            import { db } from '@repo/db'; // Adjust import path
            // ... other imports
            import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
            import { getSession } from 'next-auth/react'; // Or your auth method

            export const createTRPCContext = async (opts: CreateNextContextOptions) => {
              const { req, res } = opts;
              const session = await getSession({ req }); // Using next-auth example

              let isAdmin = false;
              if (session?.user?.id) {
                try {
                  const user = await db.query.users.findFirst({
                    where: (users, { eq }) => eq(users.id, session.user.id),
                    columns: { isAdmin: true },
                  });
                  isAdmin = user?.isAdmin ?? false;
                } catch (error) {
                   console.error("Failed to fetch user admin status:", error);
                   // Decide if you want to block context creation or default to false
                   isAdmin = false;
                }
              }

              return {
                db,
                session,
                isAdmin, // Add isAdmin to the context
                // ... other context properties
              };
            };
            ```
        * **Admin Procedure:** Create a reusable `adminProcedure` in `packages/api/src/server/trpc.ts` that enforces both authentication (`protectedProcedure`) and admin status (`ctx.isAdmin`). This will be used for any future admin-specific API endpoints.
            ```typescript
            // packages/api/src/server/trpc.ts
            import { TRPCError, initTRPC } from '@trpc/server';
            import type { createTRPCContext } from './trpc'; // Adjust import
            // ... other imports

            const t = initTRPC.context<typeof createTRPCContext>().create();

            const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
              if (!ctx.session || !ctx.session.user) {
                throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
              }
              return next({
                ctx: {
                  // infers the `session` as non-nullable
                  session: { ...ctx.session, user: ctx.session.user },
                  isAdmin: ctx.isAdmin, // Pass isAdmin along
                  db: ctx.db, // Pass db along
                },
              });
            });

            // Middleware to enforce admin status
            const enforceUserIsAdmin = t.middleware(({ ctx, next }) => {
              // This middleware assumes enforceUserIsAuthed ran first
              if (!ctx.isAdmin) {
                 throw new TRPCError({ code: 'FORBIDDEN', message: 'Requires admin privileges' });
              }
              return next({
                 ctx: {
                   session: ctx.session, // Already non-nullable from previous middleware
                   isAdmin: ctx.isAdmin,
                   db: ctx.db,
                 },
              });
            });


            export const publicProcedure = t.procedure;
            export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
            // --- Create adminProcedure ---
            // Ensures user is logged in AND is an admin
            export const adminProcedure = t.procedure.use(enforceUserIsAuthed).use(enforceUserIsAdmin);
            // ---------------------------
            export const router = t.router;
            export const createCallerFactory = t.createCallerFactory;
            ```

**2. Admin UI Routing & Layout (Updated Structure)**

* **Requirement:** Provide a dedicated, protected section within the application for admin functionalities, accessible via a single "Admin" entry in the sidebar for admin users.
* **Implementation:**
    * **Routing (`apps/web`):**
        * Maintain the protected route group `apps/web/src/routes/_admin`.
        * **Layout Guard:** The layout file (`apps/web/src/routes/_admin/layout.tsx`) must verify admin status. It should fetch user data (using session data populated with `isAdmin` during context creation is efficient) and redirect non-admins.
            ```typescript
            // apps/web/src/routes/_admin/layout.tsx (Conceptual Example)
            import { Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router';
            import { useSession } from 'next-auth/react'; // Or your auth hook
            import { useEffect } from 'react';
            import { trpc } from '@/utils/trpc'; // Adjust import path for TRPC client

            // Helper hook to get isAdmin status reliably
            function useIsAdminStatus() {
                const { data: session, status: sessionStatus } = useSession();
                // Directly use isAdmin from session if available and reliable
                const isAdminFromSession = session?.user?.isAdmin ?? false;

                // Simpler version relying solely on session:
                 const isLoading = sessionStatus === 'loading';
                 const isAdmin = isAdminFromSession;
                 return { isAdmin, isLoading };
            }


            export const Route = createFileRoute('/_admin')({
              component: AdminLayout,
              // BeforeLoad might be too early if session isn't ready, handle in component
            });

            function AdminLayout() {
              const { isAdmin, isLoading } = useIsAdminStatus();
              const router = useRouterState();
              const navigate = Route.useNavigate(); // Correct hook for navigation

              useEffect(() => {
                if (!isLoading && !isAdmin) {
                  console.log('Redirecting non-admin user...');
                  // Redirect to sign-in or home page
                   navigate({ to: '/auth/signin', search: { from: router.location.pathname } });
                  // Or: navigate({ to: '/' });
                }
              }, [isLoading, isAdmin, navigate, router.location.pathname]);

              // Show loading state or null while checking auth/admin status
              if (isLoading || !isAdmin) {
                return <div>Loading Admin Section...</div>; // Or a proper loading spinner
              }

              // Render the admin layout only if user is admin
              return (
                <div className="admin-layout p-4 border-l border-border flex-1">
                  {/* Common Admin Header if needed */}
                  {/* <h1 className="text-xl font-semibold mb-4">Admin Dashboard</h1> */}
                  <Outlet /> {/* Renders the nested admin route component */}
                </div>
              );
            }
            ```
        * **Nested Routes:** Create routes within `/_admin` for the specific admin features. These will render the stub components.
            * `/_admin/podcasts/index.tsx`
            * `/_admin/users/index.tsx`
            * `/_admin/reviews/index.tsx`
            * `/_admin/prompts/index.tsx`
    * **Side Navigation (`apps/web/src/routes/-components/layout/nav/side-bar.tsx`) (Updated):**
        * Fetch the user's session data which *must* include the `isAdmin` status (ensured by the context setup).
        * Conditionally render an "Admin" navigation section only if `isAdmin` is true.
        * Use a Shadcn `Collapsible` component for the "Admin" section.
        * Nest the links to the admin sub-routes within this collapsible section.
            ```typescript
            // apps/web/src/routes/-components/layout/nav/side-bar.tsx (Conceptual Example)
            import { Link } from '@tanstack/react-router';
            import { ShieldCheck, Users, MessageSquareText, Settings, ChevronsUpDown, LayoutDashboard, MicVocal } from 'lucide-react'; // Added icons
            import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"; // Shadcn UI
            import { Button } from "@/components/ui/button";
            import { useSession } from 'next-auth/react'; // Or your auth hook
            import { useState } from 'react';

            export function SideBar() {
              const { data: session, status } = useSession();
              // Rely on isAdmin flag populated in the session object
              const isAdmin = status === 'authenticated' && session?.user?.isAdmin === true;

              const [isAdminOpen, setIsAdminOpen] = useState(false);

              // Don't render admin section until session is loaded and user is admin
              const showAdminSection = status === 'authenticated' && isAdmin;

              return (
                <nav className="flex flex-col space-y-1 p-4 bg-card text-card-foreground border-r border-border h-full w-64">
                  {/* Regular Nav Links */}
                   <Button variant="ghost" className="w-full justify-start" asChild>
                       <Link to="/" className="flex items-center space-x-2 [&.active]:font-bold">
                           <LayoutDashboard className="h-4 w-4" />
                           <span>Dashboard</span>
                       </Link>
                   </Button>
                   <Button variant="ghost" className="w-full justify-start" asChild>
                       <Link to="/podcasts" className="flex items-center space-x-2 [&.active]:font-bold">
                           <MicVocal className="h-4 w-4" />
                           <span>My Podcasts</span>
                       </Link>
                   </Button>
                  {/* ... other non-admin links */}

                  {/* Conditional Admin Section */}
                  {showAdminSection && (
                    <Collapsible open={isAdminOpen} onOpenChange={setIsAdminOpen} className="pt-2">
                      <CollapsibleTrigger asChild>
                         <Button variant="ghost" className="w-full justify-between">
                           <span className="flex items-center space-x-2">
                             <ShieldCheck className="h-4 w-4" />
                             <span>Admin</span>
                           </span>
                           <ChevronsUpDown className="h-4 w-4 opacity-50" />
                         </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 pt-1 space-y-1 border-l border-muted ml-[18px]">
                         <Button variant="ghost" className="w-full justify-start h-8" asChild>
                            <Link to="/admin/podcasts" className="flex items-center space-x-2 text-sm [&.active]:font-bold">
                              <Settings className="h-4 w-4" />
                              <span>App</span>
                            </Link>
                         </Button>
                         <Button variant="ghost" className="w-full justify-start h-8" asChild>
                            <Link to="/admin/users" className="flex items-center space-x-2 text-sm [&.active]:font-bold">
                              <Users className="h-4 w-4" />
                              <span>Users</span>
                            </Link>
                         </Button>
                         <Button variant="ghost" className="w-full justify-start h-8" asChild>
                            <Link to="/admin/reviews" className="flex items-center space-x-2 text-sm [&.active]:font-bold">
                               <MessageSquareText className="h-4 w-4" />
                               <span>Reviews</span>
                            </Link>
                         </Button>
                         <Button variant="ghost" className="w-full justify-start h-8" asChild>
                            <Link to="/admin/prompts" className="flex items-center space-x-2 text-sm [&.active]:font-bold">
                               {/* Choose appropriate icon for Prompts */}
                               <MessageSquareText className="h-4 w-4" />
                               <span>Prompts</span>
                            </Link>
                         </Button>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </nav>
              );
            }
            ```

**3. Admin User Management (Stub Page)**

* **Requirement:** Provide a placeholder page for User Management within the admin section.
* **Implementation:**
    * **UI (`apps/web/src/routes/_admin/users/index.tsx`):**
        * Create the route component.
        * Render a simple `div` or heading indicating the purpose of the page.
            ```typescript
            // apps/web/src/routes/_admin/users/index.tsx
            import { createFileRoute } from '@tanstack/react-router';

            export const Route = createFileRoute('/_admin/users/')({
              component: AdminUsersPage,
            });

            function AdminUsersPage() {
              return (
                <div className="p-4">
                  <h2 className="text-lg font-semibold">Admin - User Management</h2>
                  <p className="text-muted-foreground mt-2">This section is currently under development.</p>
                  {/* Placeholder content */}
                </div>
              );
            }
            ```
    * **Backend (TRPC - `@repo/api`):** No specific procedures needed for the stub page itself. Future procedures (`listUsers`, `addAdmin`, `removeAdmin`) would use the `adminProcedure`.

**4. App Management (Stub Page)**

* **Requirement:** Provide a placeholder page for App Management within the admin section.
* **Implementation:**
    * **UI (`apps/web/src/routes/_admin/podcasts/index.tsx`):**
        * Create the route component.
        * Render a simple `div` or heading.
            ```typescript
            // apps/web/src/routes/_admin/podcasts/index.tsx
            import { createFileRoute } from '@tanstack/react-router';

            export const Route = createFileRoute('/_admin/podcasts/')({
              component: AdminAppPage,
            });

            function AdminAppPage() {
              return (
                <div className="p-4">
                  <h2 className="text-lg font-semibold">Admin - App Management</h2>
                  <p className="text-muted-foreground mt-2">This section is currently under development.</p>
                  {/* Placeholder content */}
                </div>
              );
            }
            ```
    * **Backend (TRPC - `@repo/api`):** No specific procedures needed for the stub page.

**5. Review Management (Stub Page)**

* **Requirement:** Provide a placeholder page for Review Management within the admin section.
* **Implementation:**
    * **UI (`apps/web/src/routes/_admin/reviews/index.tsx`):**
        * Create the route component.
        * Render a simple `div` or heading.
            ```typescript
            // apps/web/src/routes/_admin/reviews/index.tsx
            import { createFileRoute } from '@tanstack/react-router';

            export const Route = createFileRoute('/_admin/reviews/')({
              component: AdminReviewsPage,
            });

            function AdminReviewsPage() {
              return (
                <div className="p-4">
                  <h2 className="text-lg font-semibold">Admin - Review Management</h2>
                  <p className="text-muted-foreground mt-2">This section is currently under development.</p>
                  {/* Placeholder content */}
                </div>
              );
            }
            ```
    * **Backend (TRPC - `@repo/api` & `@repo/reviews`):** No specific procedures needed for the stub page.

**6. Prompt Management (Stub Page)**

* **Requirement:** Provide a placeholder page for Prompt Management within the admin section.
* **Implementation:**
    * **Database (`@repo/db`):** No database schema needed for the stub page.
    * **UI (`apps/web/src/routes/_admin/prompts/index.tsx`):**
        * Create the route component.
        * Render a simple `div` or heading.
            ```typescript
            // apps/web/src/routes/_admin/prompts/index.tsx
            import { createFileRoute } from '@tanstack/react-router';

            export const Route = createFileRoute('/_admin/prompts/')({
              component: AdminPromptsPage,
            });

            function AdminPromptsPage() {
              return (
                <div className="p-4">
                  <h2 className="text-lg font-semibold">Admin - Prompt Management</h2>
                  <p className="text-muted-foreground mt-2">This section is currently under development.</p>
                  {/* Placeholder content */}
                </div>
              );
            }
            ```
    * **Backend (TRPC - `@repo/api`):** No specific procedures needed for the stub page.

**General Conventions & Considerations:**

* **Component Structure:** Adhere to `.cursor/rules/component-directory-structure.mdc`. Place admin route components under `apps/web/src/routes/_admin/`.
* **Styling:** Strictly use Shadcn UI components (`pnpm ui-add ...`) and Tailwind CSS utility classes, following the semantic theme (`bg-card`, `text-foreground`, etc.) defined in `tools/tailwind/style.css` and `fincast-style-guide.mdc`.
* **Type Safety:** Utilize TRPC's inferred types (`inferRouterOutputs`, `inferRouterInputs`) on the frontend via the TRPC proxy (`@/utils/trpc`) as per `infer-types.mdc` when implementing actual features later.
* **State Management:** `@tanstack/react-query` (via the TRPC proxy) will be used for server state when features are implemented. `@tanstack/react-form` can be used for future forms.
* **Error Handling:** The layout guard handles the primary authorization error (redirect). Implement loading states in the layout and potentially basic error boundaries.