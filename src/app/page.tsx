import { redirect } from "next/navigation";

// There is no public home page (US-1). The proxy sends signed-out visitors to
// /sign-in. Everyone else goes to /communities, which checks the session on
// the server.
export default function Home() {
  redirect("/communities");
}
