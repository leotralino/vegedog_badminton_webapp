import Navbar from '@/components/Navbar'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
