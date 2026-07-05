import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { DashboardPage } from "./pages/Dashboard";
import { FilesPage } from "./pages/files.page";
import { RootLayout } from "./routes/__root";
import { CreatePostPage } from "./pages/create-post.page";

const rootRoute = createRootRoute({
    component: RootLayout,
});

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: DashboardPage,
});

const filesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/files",
    component: FilesPage,
});

const createPostRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/create-post",
    component: CreatePostPage,
});

const routeTree = rootRoute.addChildren([indexRoute, filesRoute, createPostRoute]);

export const router = createRouter({ routeTree });

// type-safety for <Link to="..." />
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}