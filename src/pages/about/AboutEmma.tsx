import { EmmaTitleBar } from "../../components/emma/titlebar"

export default function AboutEmma() {
  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold my-3">About Emma</h1>
          <p className="text-muted-foreground my-3">
            EMMA is the official, custom-developed, event management application for the ManKind Project and all of its official events. It has been built to streamline finding, signing up for, paying for, managing and participating in events throughout the United States. It has been tailored to the needs of ManKind Project members, warriors and leaders, as well as for future initiates. Emma is developed, maintained, and operated on a volunteer basis by The Geeks of Service.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold my-3">About Geeks of Service</h1>
          <p className="text-muted-foreground my-3">
            Geeks of Service (GOS) is a service-oriented Affinity Group of Mankind Project USA for all self-identified geeks (Information Technology Hobbyists and Professionals). Our purpose is two-fold; firstly, our mission is to provide a safe space for all geeks to explore their own unique manhood. The second key aspect of our purpose is to provide The ManKind Project with vital professional-grade IT development, management, and operations on a volunteer basis in support of The ManKind Project's mission of "More men, in more circles, in more places." Emma is just one very visible part of that support.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold my-3">Getting Help</h1>
          <p className="text-muted-foreground my-3">
            You can get help with Emma by logging into the MKP's official chat application: <a href="https://chat.mkpusa.org/">MKP USA Chat</a> and reaching out to the Geeks of Service for help in the <span className="font-mono">#emma-help</span> channel or by emailing <a href="mailto:emma-help@mkpusa.org">emma-help@mkpusa.org</a>. 
          </p>
        </div>
      </div>
    </div>
  )
}
