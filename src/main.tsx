import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Install Supabase access guard in development
import { supabase } from "@/integrations/supabase/client";
import { installSupabaseGuard } from "@/lib/supabase-guard";

if (import.meta.env.DEV) {
  installSupabaseGuard(supabase);
}

createRoot(document.getElementById("root")!).render(<App />);
