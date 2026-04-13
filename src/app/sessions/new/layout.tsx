import Navbar from '@/components/Navbar'

export default function NewSessionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  )
}
