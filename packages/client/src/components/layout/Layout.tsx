import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-60 flex flex-col min-h-screen">
        <StatusBar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
