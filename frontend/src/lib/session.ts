// Supabase Auth owns the browser session. After sign-in/sign-out, clear the React Query
// cache so data from one account cannot be rendered for another account.
import { queryClient } from "./queryClient";
import { supabase } from "./supabase";

// Call after every successful login/signup.
export function beginSession(): void {
  queryClient.clear();
}

// Call from sign-out controls; Supabase clears its persisted session before redirecting.
export async function endSession(redirectTo: string = "/admin"): Promise<void> {
  try {
    await supabase.auth.signOut();
  } finally {
    queryClient.clear();
    window.location.assign(redirectTo);
  }
}
