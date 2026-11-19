import { Link, useSubmit } from "react-router";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import type { UserRole } from "~/db/schema";
import { UserAvatar } from "~/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export type SidebarUser = {
  name: string;
  role: UserRole;
  avatarUrl: string | null;
};

export function UserMenu({ user }: { user: SidebarUser }) {
  // A <Form> inside the menu unmounts as the menu closes on select, before
  // its submit can run, so sign-out submits programmatically instead.
  const submit = useSubmit();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={user.name}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent"
      >
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium break-words">{user.name}</div>
          <div className="truncate text-xs capitalize text-sidebar-foreground/50">
            {user.role}
          </div>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width)"
      >
        <DropdownMenuLabel className="break-words">
          {user.name}
          <div className="text-xs font-normal capitalize text-muted-foreground">
            {user.role}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            submit(null, { method: "post", action: "/api/logout" })
          }
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
