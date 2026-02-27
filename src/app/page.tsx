import BudgetApp from "@/components/BudgetApp";
import { getTemplates } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/actions";

export default async function Home() {
  const templates = await getTemplates();
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-8">
      <BudgetApp
        initialTemplates={JSON.parse(JSON.stringify(templates))}
        user={user ? JSON.parse(JSON.stringify(user)) : null}
        logoutAction={logout}
      />

      {/* Visual background elements */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 bg-[#0f172a]" />
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px] -z-10" />
    </div>
  );
}
