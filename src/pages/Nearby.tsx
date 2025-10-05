import { EmmaTitleBar } from "../components/emma/titlebar"

export default function Nearby() {
  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Nearby Events</h1>
          <p className="text-muted-foreground">Content for nearby events will be added here.</p>
        </div>
      </div>
    </div>
  )
}
