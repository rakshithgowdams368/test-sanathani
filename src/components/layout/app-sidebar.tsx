import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  Wand2,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "New Story", icon: PlusCircle, path: "/new-story" },
  { title: "Prompt Studio", icon: Wand2, path: "/prompt-studio" },
  { title: "Settings", icon: Settings, path: "/settings" },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="font-display text-sm font-bold text-primary-foreground">P</span>
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold tracking-wide text-foreground">
              Purana Engine
            </h2>
            <p className="text-xs text-muted-foreground">Cinematic Production</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-xs text-muted-foreground">
            {user?.email}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
