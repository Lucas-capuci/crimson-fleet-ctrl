import { Sidebar } from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-5 sm:p-6 lg:p-8 xl:p-10 max-w-[1800px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
