import { EmmaTitleBar } from "../../components/emma/titlebar"

export default function AboutManKindProject() {
  return (
    <div className="min-h-screen bg-background">
      <EmmaTitleBar />
      <div className="pt-20 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold my-3">Who We Are</h1>
          <ul className="space-y-3">
            <li>
              • <span className="font-bold">Global</span> – A Brotherhood of Nonprofit/Charitable Organizations. Men of all origins are welcome.
            </li>
            <li>
              • <span className="font-bold">Non-Religious</span> – Men of all faiths and no faith are welcome.
            </li>
            <li>
              • <span className="font-bold">Inclusive</span> – Men of all backgrounds, orientations, ages, and abilities are welcome.
            </li>
          </ul>

          <iframe 
            className="width-full aspect-video my-3"
            src="https://www.youtube.com/embed/if_fGRcdjEc"
            title="ManKind Project USA - Healthy Men&#39;s Community"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          ></iframe>

          <div>
            <h1 className="text-3xl font-bold my-3">Global</h1>
            <p className="my-3">
              The ManKind Project has a presence in more than 23 nations. The ManKind Project (MKP) is a global
              brotherhood of nonprofit/charitable organizations that conduct challenging and highly rewarding programs
              for men at every stage of life. The ManKind Project currently has 12 Regions: Australia, Belgium, Canada,
              France, Germany, Mexico, New Zealand, Nordic (Norway, Denmark, Sweden, Finland), South Africa,
              Switzerland, United Kingdom & Ireland, and the United States. There are also a number of developing
              Regions: Israel, Netherlands, Romania, Spain and Central Africa (DRC, Cameroon).
            </p>
            <p className="my-4">
              The ManKind Project supports a global brotherhood of over 1,000 peer-facilitated men's groups serving
              close to 10,000 men each week. In an MKP men's group, men mentor men through the passages of their lives.
            </p>
          </div>

          <iframe
            className="width-full aspect-video my-3"
            src="https://www.youtube.com/embed/NWgZ13s7kXo"
            title="ManKind Project New Zealand powerful video!"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          ></iframe>

          <div>
            <h1 className="text-3xl font-bold my-3">Empowering</h1>
            <p className="my-3">
              The ManKind Project empowers men to missions of service, supporting men to make a difference in the lives
              of others – men, women, and children around the world. We help men through any transition, men at all
              levels of success, men facing almost any challenge. Our flagship training, is described by many as the
              most powerful men's training available: New Warrior Training Adventure. The ManKind Project (MKP) is not
              affiliated with any religious practice or political party. We strive to be increasingly inclusive and
              affirming of cultural differences, especially with respect to color, class, sexual orientation, faith,
              age, ability, ethnicity, and nationality.
            </p>
          </div>

          <iframe
            className="width-full aspect-video my-3"
            src="https://www.youtube.com/embed/oQf8P83NUA8"
            title="The ManKind Project Durango - Changing the World"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          ></iframe>

          <div>
            <h1 className="text-3xl font-bold my-3">Find out more</h1>
            <p className="my-3">
              The ManKind Project empowers men to missions of service, supporting men to make a difference in the lives
              of others – men, women, and children around the world. We help men through any transition, men at all
              levels of success, men facing almost any challenge. Our flagship training, is described by many as the
              most powerful men's training available: New Warrior Training Adventure. The ManKind Project (MKP) is not
              affiliated with any religious practice or political party. We strive to be increasingly inclusive and
              affirming of cultural differences, especially with respect to color, class, sexual orientation, faith,
              age, ability, ethnicity, and nationality.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
