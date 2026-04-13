import Navbar from '@/components/Navbar'
import BottomNav from '@/components/BottomNav'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div className="pb-20">{children}</div>
      <BottomNav />
    </>
  )
}
