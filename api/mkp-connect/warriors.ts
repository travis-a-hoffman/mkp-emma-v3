import type { VercelRequest, VercelResponse } from "@vercel/node"
import type { EventBasic } from "../../src/types/event"
import type { Warrior } from "../../src/types/person"
import type { Area } from "../../src/types/area"
import type { Community } from "../../src/types/community"

import { createRequire } from "module"

const require = createRequire(import.meta.url)

const config = {
  server: "https://mkpconnect.org",
  // See: https://civicrm.stackexchange.com/questions/9945/how-do-i-set-up-an-api-key-for-a-user
  api_key: process.env.CIVICRM_API_KEY,
}

/*
 * Generated code from
  https://mkpconnect.org/civicrm/api4#/explorer/Contact/get?select=%5B%22first_name%22,%22middle_name%22,%22last_name%22,%22phone_primary.phone%22,%22email_primary.email%22,%22address_primary.street_address%22,%22address_primary.city%22,%22address_primary.postal_code%22,%22address_primary.country_id:abbr%22,%22address_primary.state_province_id:abbr%22,%22Warrior_Data.Initiation_Date%22,%22id%22,%22uf_match.uf_id%22%5D&_lang=js&where=%5B%5B%22email_primary.email%22,%22%3D%22,%22travis.a.hoffman@gmail.com%22%5D%5D&join=%5B%5B%22UFMatch%20AS%20uf_match%22,%22LEFT%22%5D%5D
 *
 */

const CiviCRM = require("civicrm")(config)

// This is the JSON data structure returned from MKPConnect's Drupal-based API Query.
interface ConnectWarrior {
  id: number
  "uf_match.uf_id": number
  first_name: string
  middle_name: string
  last_name: string
  "Warrior_Data.Animal_Name": string
  "phone_primary.phone": string
  "email_primary.email": string
  "address_primary.street_address": string
  "address_primary.city": string
  "address_primary.state_province_id:abbr": string
  "address_primary.postal_code": string
  "address_primary.country_id:abbr": string
  "Warrior_Data.Initiation_Date": string
  "Warrior_Data.Initiation_Center": string
  "Warrior_Data.Current_Community:name": string
  "Warrior_Data.Current_Center:name": string
}

interface Address {
  address_1: string
  address_2?: string | null
  city: string
  state: string
  postal_code: string
  country: string
}

export interface WarriorWithRelations extends Warrior<EventBasic> {
  physical_address: Address | null
  mailing_address: Address | null
  area: Area | null
  community: Community | null
  civicrm_id: string
  drupal_id: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Only GET requests are supported.",
    })
  }

  try {
    const { email } = req.query

    // If no email provided, return empty array
    if (!email || typeof email !== "string") {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
      })
    }

    //console.log("[v0] Making CiviCRM API call with email:", email)
    //console.log("[v0] CiviCRM config:", { server: config.server, hasApiKey: !!config.api_key })

    let mkpResults: ConnectWarrior[]

    try {
      mkpResults = await CiviCRM.get("Contact", {
        select: [
          "id",
          "uf_match.uf_id",
          "first_name",
          "middle_name",
          "last_name",
          "phone_primary.phone",
          "email_primary.email",
          "address_primary.street_address",
          "address_primary.city",
          "address_primary.state_province_id:abbr",
          "address_primary.postal_code",
          "address_primary.country_id:abbr",
          "Warrior_Data.Initiation_Date",
          "Warrior_Data.Initiation_Center:name",
          "Warrior_Data.Current_Center:name",
          "Warrior_Data.Current_Community:name",
          "Warrior_Data.Animal_Name",
        ],
        join: [["UFMatch AS uf_match", "LEFT"]],
        where: [["email_primary.email", "CONTAINS", email]],
        limit: 10,
      })

      //console.log("[v0] CiviCRM API raw response type:", typeof mkpResults)
      //console.log("[v0] CiviCRM API raw response:", JSON.stringify(mkpResults, null, 2))
      //console.log("[v0] Is mkpResults an array?", Array.isArray(mkpResults))

      if (!mkpResults) {
        console.log("[v0] mkpResults is null/undefined, setting to empty array")
        mkpResults = []
      } else if (!Array.isArray(mkpResults)) {
        console.log("[v0] mkpResults is not an array, attempting to extract array from response")

        // Check if it's an object with a values/results property
        if (typeof mkpResults === "object" && "values" in mkpResults) {
          mkpResults = (mkpResults as any).values
          console.log(
            "[v0] Extracted values property, new length:",
            Array.isArray(mkpResults) ? mkpResults.length : "not an array",
          )
        } else if (typeof mkpResults === "object" && "results" in mkpResults) {
          mkpResults = (mkpResults as any).results
          console.log(
            "[v0] Extracted results property, new length:",
            Array.isArray(mkpResults) ? mkpResults.length : "not an array",
          )
        } else {
          console.log("[v0] mkpResults structure unknown, converting to empty array")
          mkpResults = []
        }
      }

      if (!Array.isArray(mkpResults)) {
        console.error("[v0] After processing, mkpResults is still not an array:", typeof mkpResults)
        mkpResults = []
      }

      console.log("[v0] CiviCRM API call successful, received", mkpResults.length, "results")
    } catch (crmError: any) {
      console.error("[v0] CiviCRM API call failed:")
      console.error("[v0] Error message:", crmError.message)
      console.error("[v0] Error stack:", crmError.stack)

      // Try to extract more details from the error
      if (crmError.response) {
        console.error("[v0] HTTP Response status:", crmError.response.status)
        console.error("[v0] HTTP Response statusText:", crmError.response.statusText)

        // Try to get response body
        try {
          const responseText = await crmError.response.text()
          console.error("[v0] HTTP Response body:", responseText)
        } catch (bodyError) {
          // Added type checking for bodyError to fix TypeScript error
          const errorMessage = bodyError instanceof Error ? bodyError.message : String(bodyError)
          console.error("[v0] Could not read response body:", errorMessage)
        }
      }

      // Check if it's a network/connection error
      if (crmError.code) {
        console.error("[v0] Error code:", crmError.code)
      }

      // Check for specific CiviCRM error details
      if (crmError.error_message) {
        console.error("[v0] CiviCRM error message:", crmError.error_message)
      }

      if (crmError.error_code) {
        console.error("[v0] CiviCRM error code:", crmError.error_code)
      }

      // Re-throw with more context
      throw new Error(`CiviCRM API call failed: ${crmError.message}. Check logs for detailed error information.`)
    }

    const emmaResults: WarriorWithRelations[] = []

    if (Array.isArray(mkpResults) && mkpResults.length > 0) {
      mkpResults.forEach((cw: ConnectWarrior) => {
        if (!cw || typeof cw !== "object") {
          console.log("[v0] Skipping invalid contact data:", cw)
          return
        }

        const w = {} as WarriorWithRelations
        if (!w) return

        w.first_name = cw["first_name"]
        w.middle_name = cw["middle_name"]
        w.last_name = cw["last_name"]
        w.inner_essence_name = cw["Warrior_Data.Animal_Name"]

        w.phone = cw["phone_primary.phone"]
        w.email = cw["email_primary.email"]

        w.physical_address = {} as Address
        w.physical_address.address_1 = cw["address_primary.street_address"]
        w.physical_address.address_2 = null
        w.physical_address.city = cw["address_primary.city"]
        w.physical_address.state = cw["address_primary.state_province_id:abbr"]
        w.physical_address.postal_code = cw["address_primary.postal_code"]
        w.physical_address.country = cw["address_primary.country_id:abbr"]

        w.mailing_address = {} as Address
        w.mailing_address.address_1 = cw["address_primary.street_address"]
        w.mailing_address.address_2 = null
        w.mailing_address.city = cw["address_primary.city"]
        w.mailing_address.state = cw["address_primary.state_province_id:abbr"]
        w.mailing_address.postal_code = cw["address_primary.postal_code"]
        w.mailing_address.country = cw["address_primary.country_id:abbr"]

        // An Event object, uplift this to include the area 
        w.initiation_event = {
          id: "", // TODO Import and recall the Event information.
          name: "", // TODO Import and recall the Event information.
          area_id: null, // TODO find the event Area ID by name: via a call to /api/areas?name=Northwest
//          area: {
//            id: null,
//            name: cw["Warrior_Data.Current_Center:name"],
//          },
          community_id: null,
          event_type_id: "e542d6df-e653-4e94-9d08-1b0b8fed0bad", // TODO Look up the EventType ID via call to /api/event-types?code=NWTA
//          community: null, // NWTAs are Area-driven, and don't have a Community associated with them. Other Event Types may.
          venue_id: null, // TODO Lookup the event venue ID by name: via call to /api/venues?name=Grey+Owl+Hollow&Area=Northwest
//          venue: null, // TODO Lookup the event venue by name: e.g. "Grey Owl Hollow"
          start_at: new Date(cw["Warrior_Data.Initiation_Date"]).toISOString(),
          end_at: new Date(cw["Warrior_Data.Initiation_Date"]).toISOString(), // TODO Calculate 3 days before end date.
          is_published: true, // TODO Import and recall the Event information
          is_active: true, // TODO Import and recall the Event information
          created_at: new Date().toISOString(), // TODO Import and recall the Event information (or maybe generate this?)
          updated_at: new Date().toISOString(), // TODO Import and recall the Event information (or maybe generate this?)
        }

        // TODO Implement looking up the Area by it's name ... via a REST call?
        w.area = {
          id: "",
          name: cw["Warrior_Data.Current_Center:name"],
          code: "UNK",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        // TODO Implement looking up the Community by it's name ... via a REST call?
        w.community = {
          id: "",
          name: cw["Warrior_Data.Current_Community:name"],
          code: "UNK",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        w.civicrm_id = `${cw["id"]}`
        w.drupal_id = `${cw["uf_match.uf_id"]}`

        emmaResults.push(w)
      })
    } else {
      console.log("[v0] No valid results to process, mkpResults:", mkpResults)
    }

    console.log("[v0] Returning emmaResults:", emmaResults) // Added missing comma after console.log statement

    return res.status(200).json({
      success: true,
      data: emmaResults,
      count: emmaResults.length,
    })
  } catch (error) {
    console.error("[v0] MKP Connect Warriors API error:", error)

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    })
  }
}
