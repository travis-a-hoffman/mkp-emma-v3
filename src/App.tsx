import { Routes, Route } from "react-router-dom"
import { Auth0Provider } from "./lib/auth0-provider"
import { EmmaProvider } from "./lib/emma-provider"
import { MkpConnectProvider } from "./lib/mkpconnect-provider"

import Home from "./pages/Home"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Nearby from "./pages/Nearby"
import Staffing from "./pages/Staffing"
import StaffingSearch from "./pages/StaffingSearch"
import Upcoming from "./pages/Upcoming"
import Training from "./pages/Training"
import TrainingSearch from "./pages/TrainingSearch"
import Warrior from "./pages/Warrior"
import WarriorSearch from "./pages/WarriorSearch"
import Nwta from "./pages/Nwta"
import NwtaSearch from "./pages/NwtaSearch"

import AboutEmma from "./pages/about/AboutEmma"
import AboutManKindProject from "./pages/about/AboutManKindProject"
import AboutManKindProjectUSA from "./pages/about/AboutManKindProjectUSA"
import AboutNewWarriorTrainingAdventure from "./pages/about/AboutNewWarriorTrainingAdventure"
import AboutMyArea from "./pages/about/AboutMyArea"
import AboutMyCommunity from "./pages/about/AboutMyCommunity"

import AdminDashboard from "./pages/admin/AdminDashboard"
import AdminVenues from "./pages/admin/AdminVenues"
import AdminPeople from "./pages/admin/AdminPeople"
import AdminAreas from "./pages/admin/AdminAreas"
import AdminCommunities from "./pages/admin/AdminCommunities"
import AdminNwtaEvents from "./pages/admin/AdminNwtaEvents"
import AdminNwtaRoles from "./pages/admin/AdminNwtaRoles"
import AdminEvents from "./pages/admin/AdminEvents"
import AdminEventTypes from "./pages/admin/AdminEventTypes"
import AdminProspects from "./pages/admin/AdminProspects"
import AdminWarriors from "./pages/admin/AdminWarriors"
import AdminMembers from "./pages/admin/AdminMembers"
import AdminRegistrants from "./pages/admin/AdminRegistrants"
import AdminFriends from "./pages/admin/AdminFriends"
import AdminAffiliates from "./pages/admin/AdminAffiliates"

import Join from "./pages/join/Join"
import JoinWelcome from "./pages/join/JoinWelcome"
import JoinProfileImport from "./pages/join/JoinProfileImport"
import JoinProfileSetup from "./pages/join/JoinProfileSetup"

function App() {
  return (
    <Auth0Provider>
      <EmmaProvider>
        <MkpConnectProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/nearby" element={<Nearby />} />
            <Route path="/upcoming" element={<Upcoming />} />
            <Route path="/staffing" element={<StaffingSearch />} />
            <Route path="/staffing/:uuid" element={<Staffing />} />
            <Route path="/training" element={<TrainingSearch />} />
            <Route path="/training/:uuid" element={<Training />} />
            <Route path="/nwta" element={<NwtaSearch />} />
            <Route path="/nwta/:uuid" element={<Nwta />} />
            <Route path="/warrior" element={<WarriorSearch />} />
            <Route path="/warrior/:uuid" element={<Warrior />} />

            <Route path="/about/emma" element={<AboutEmma />} />
            <Route path="/about/mankind-project" element={<AboutManKindProject />} />
            <Route path="/about/mankind-project-usa" element={<AboutManKindProjectUSA />} />
            <Route path="/about/new-warrior-training-adventure" element={<AboutNewWarriorTrainingAdventure />} />
            <Route path="/about/my-area" element={<AboutMyArea />} />
            <Route path="/about/my-community" element={<AboutMyCommunity />} />

            <Route path="/join" element={<Join />} />
            <Route path="/join/profile/import" element={<JoinProfileImport />} />
            <Route path="/join/profile/setup" element={<JoinProfileSetup />} />
            <Route path="/join/profile/complete" element={<JoinWelcome />} />

            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/venues" element={<AdminVenues />} />
            <Route path="/admin/people" element={<AdminPeople />} />
            <Route path="/admin/areas" element={<AdminAreas />} />
            <Route path="/admin/communities" element={<AdminCommunities />} />
            <Route path="/admin/nwtas" element={<AdminNwtaEvents />} />
            <Route path="/admin/nwta-roles" element={<AdminNwtaRoles />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/event-types" element={<AdminEventTypes />} />
            <Route path="/admin/prospects" element={<AdminProspects />} />
            <Route path="/admin/warriors" element={<AdminWarriors />} />
            <Route path="/admin/members" element={<AdminMembers />} />
            <Route path="/admin/registrants" element={<AdminRegistrants />} />
            <Route path="/admin/friends" element={<AdminFriends />} />
            <Route path="/admin/affiliates" element={<AdminAffiliates />} />
          </Routes>
        </MkpConnectProvider>
      </EmmaProvider>
    </Auth0Provider>
  )
}

export default App
