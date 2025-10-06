import type { VercelRequest, VercelResponse } from "@vercel/node"
import * as os from "node:os"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "../_lib/generated/igroups-client/index.js"
import type {
  IGroup,
  IGroupClassField,
  IGroupStatusField,
  IGroupTypeField,
  IGroupOwnerField,
  IGroupFormatField,
  IGroupMeetingNightField,
  IGroupMeetingTimeField,
  IGroupAreaField,
  IGroupCommunityField,
  IGroupCityField,
  IGroupStateProvinceField,
  IGroupPostalCodeField,
  IGroupAcceptingNewMembersField,
  IGroupAcceptsInitiatedVisitorsField,
  IGroupAcceptsUninitiatedVisitorsField,
  IGroupMixedGenderField,
  IGroupContactUidField,
} from "../_lib/generated/igroups-client/index.js"

// Load the types referenced in the queries?

const adapter = new PrismaMariaDb({
  host: process.env.MKP_CONNECT_DRUPAL_DB_HOST || "mkpconnect.org",
  port: Number.parseInt(process.env.MKP_CONNECT_DRUPAL_DB_PORT || "3306"),
  user: process.env.MKP_CONNECT_DB_USERNAME,
  password: process.env.MKP_CONNECT_DB_PASSWORD,
  database: process.env.MKP_CONNECT_DRUPAL_DB_NAME || "connect_drupal",
  connectionLimit: 5,
})

const prisma = new PrismaClient({ adapter })

type IGroupWithAllFields = IGroup & {
  // Scalar fields
  /*
  vid: number | null
  type: string
  language: string
  title: string
  uid: number
  status: number
  created: number
  changed: number
  comment: number
  promote: number
  sticky: number
  tnid: number
  translate: number
   */
  // Relationship fields
  iGroupClass: IGroupClassField | null
  iGroupStatus: IGroupStatusField | null
  iGroupType: IGroupTypeField | null
  owner: IGroupOwnerField | null
  format: IGroupFormatField | null
  meetingNight: IGroupMeetingNightField | null
  meetingTime: IGroupMeetingTimeField | null
  areaName: IGroupAreaField | null
  communityName: IGroupCommunityField | null
  city: IGroupCityField | null
  stateProvince: IGroupStateProvinceField | null
  postalCode: IGroupPostalCodeField | null
  acceptingNewMembers: IGroupAcceptingNewMembersField | null
  acceptsInitiatedVisitors: IGroupAcceptsInitiatedVisitorsField | null
  acceptsUninitiatedVisitors: IGroupAcceptsUninitiatedVisitorsField | null
  mixedGender: IGroupMixedGenderField | null
  contactUid: IGroupContactUidField | null
}

/*
 * This data is taken from a Drupal 7 database which is highly normalized...
 *
 * This is the raw MariaDB SQL Query:
 * 
  SELECT
    connect_drupal.node.nid as mkp_connect_id,
    connect_drupal.node.title as igroup_name,
    connect_drupal.field_data_field_igroup_type.field_igroup_type_value as igroup_type,
    connect_drupal.field_data_field_owner.field_owner_value as owner,
    connect_drupal.field_data_field_venue.field_venue_value as format,
    connect_drupal.field_data_field_meeting_night.field_meeting_night_value as meeting_night,
    connect_drupal.field_data_field_meeting_time.field_meeting_time_value as meeting_time,
    connect_drupal.field_data_field_area.field_area_value as area_name,
    connect_drupal.field_data_field_community.field_community_value as community_name,
    connect_drupal.field_data_field_city.field_city_value as city,
    connect_drupal.field_data_field_state_province.field_state_province_value as state_province,
    connect_drupal.field_data_field_postal_code.field_postal_code_value as postal_code,
    connect_drupal.field_data_field_igroup_new_members.field_igroup_new_members_value as accepts_new_members,
    connect_drupal.field_data_field_igroup_initiated_visit.field_igroup_initiated_visit_value as accepts_initiated_visitors,
    connect_drupal.field_data_field_igroup_uninitiated_visit.field_igroup_uninitiated_visit_value as accepts_uninitiated_visitors,
    connect_drupal.field_data_field_mixed_gender.field_mixed_gender_value as is_mixed_gender,
    connect_drupal.field_data_field_contact.field_contact_uid as mkp_connect_contact_uid,
    connect_civicrm.civicrm_contact.display_name as mkp_connect_contact_name
  FROM
    connect_drupal.node
      INNER JOIN connect_drupal.field_data_field_owner ON node.nid = field_data_field_owner.entity_id
      INNER JOIN connect_drupal.field_data_field_venue ON node.nid = field_data_field_venue.entity_id
      INNER JOIN connect_drupal.field_data_field_meeting_night	ON 	node.nid = field_data_field_meeting_night.entity_id
      INNER JOIN connect_drupal.field_data_field_area ON node.nid = field_data_field_area.entity_id
      INNER JOIN connect_drupal.field_data_field_community ON node.nid = field_data_field_community.entity_id
      INNER JOIN connect_drupal.field_data_field_city ON node.nid = field_data_field_city.entity_id
      INNER JOIN connect_drupal.field_data_field_state_province ON node.nid = field_data_field_state_province.entity_id
      INNER JOIN connect_drupal.field_data_field_meeting_time ON node.nid = field_data_field_meeting_time.entity_id
      INNER JOIN connect_drupal.field_data_field_igroup_new_members ON node.nid = field_data_field_igroup_new_members.entity_id
      INNER JOIN connect_drupal.field_data_field_igroup_initiated_visit ON node.nid = field_data_field_igroup_initiated_visit.entity_id
      INNER JOIN connect_drupal.field_data_field_igroup_uninitiated_visit ON node.nid = field_data_field_igroup_uninitiated_visit.entity_id
      INNER JOIN connect_drupal.field_data_field_mixed_gender ON node.nid = field_data_field_mixed_gender.entity_id
      INNER JOIN connect_drupal.field_data_field_contact ON node.nid = field_data_field_contact.entity_id
      INNER JOIN connect_drupal.field_data_field_postal_code ON node.nid = field_data_field_postal_code.entity_id
      INNER JOIN connect_drupal.field_data_field_igroup_type ON node.nid = field_data_field_igroup_type.entity_id
      INNER JOIN connect_civicrm.civicrm_uf_match ON connect_drupal.field_data_field_contact.field_contact_uid = connect_civicrm.civicrm_uf_match.uf_id
      INNER JOIN connect_civicrm.civicrm_contact 	ON 	connect_civicrm.civicrm_uf_match.contact_id = connect_civicrm.civicrm_contact.id
  WHERE
    node.type = 'igroups'
  ORDER BY
    igroup_name
 *
 */
interface ConnectIGroup {
  id: number
  iGroupName: string | null | undefined
  iGroupStatus: string | null | undefined
  iGroupType: string | null | undefined
  owner: string | null | undefined
  format: string | null | undefined
  meetingNight: string | null | undefined
  meetingTime: string | null | undefined
  areaName: string | null | undefined
  communityName: string | null | undefined
  city: string | null | undefined
  stateProvince: string | null | undefined
  postalCode: string | null | undefined
  acceptingNewMembers: string | null | undefined // ('yes' | 'no' | 'contact')
  acceptsInitiatedVisitors: string | null | undefined // ('yes' | 'no' | 'contact')
  acceptsUninitiatedVisitors: string | null | undefined // ('yes' | 'no' | 'contact' )
  isMixedGender: boolean
  mkpConnectContactUid: number | null | undefined
  //mkp_connect_contact_name: string  // This might not be resolvable because it's in a different schema...
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

  /*
  SELECT
    connect_drupal.node.nid as mkp_connect_id,
    connect_drupal.node.title as igroup_name,
    connect_drupal.field_data_field_igroup_type.field_igroup_type_value as igroup_type,
    connect_drupal.field_data_field_owner.field_owner_value as owner,
    connect_drupal.field_data_field_venue.field_venue_value as format,
    connect_drupal.field_data_field_meeting_night.field_meeting_night_value as meeting_night,
    connect_drupal.field_data_field_meeting_time.field_meeting_time_value as meeting_time,
    connect_drupal.field_data_field_area.field_area_value as area_name,
    connect_drupal.field_data_field_community.field_community_value as community_name,
    connect_drupal.field_data_field_city.field_city_value as city,
    connect_drupal.field_data_field_state_province.field_state_province_value as state_province,
    connect_drupal.field_data_field_postal_code.field_postal_code_value as postal_code,
    connect_drupal.field_data_field_igroup_new_members.field_igroup_new_members_value as accepts_new_members,
    connect_drupal.field_data_field_igroup_initiated_visit.field_igroup_initiated_visit_value as accepts_initiated_visitors,
    connect_drupal.field_data_field_igroup_uninitiated_visit.field_igroup_uninitiated_visit_value as accepts_uninitiated_visitors,
    connect_drupal.field_data_field_mixed_gender.field_mixed_gender_value as is_mixed_gender,
    connect_drupal.field_data_field_contact.field_contact_uid as mkp_connect_contact_uid,
    connect_civicrm.civicrm_contact.display_name as mkp_connect_contact_name
  WHERE
    node.type = 'igroups'
   */
  try {
    const iGroups: IGroupWithAllFields[] = await prisma.iGroup.findMany({
      where: { type: { equals: "igroups" } },
      include: {
        iGroupClass: true,
        iGroupStatus: true,
        iGroupType: true,
        owner: true,
        format: true,
        meetingNight: true,
        meetingTime: true,
        areaName: true,
        communityName: true,
        city: true,
        stateProvince: true,
        postalCode: true,
        acceptingNewMembers: true,
        acceptsInitiatedVisitors: true,
        acceptsUninitiatedVisitors: true,
        mixedGender: true,
        contactUid: true,
      },
    })

    const connectIGroups: ConnectIGroup[] = []

    iGroups.forEach((ig) => {
      const connectIGroup: ConnectIGroup = {
        id: ig.nid,
        iGroupName: ig.title,
        iGroupType: ig.iGroupType?.value,
        iGroupStatus: ig.iGroupStatus?.value,
        owner: ig.owner?.value,
        format: ig.format?.value,
        meetingNight: ig.meetingNight?.value,
        meetingTime: ig.meetingTime?.value,
        areaName: ig.areaName?.value,
        communityName: ig.communityName?.value,
        city: ig.city?.value,
        stateProvince: ig.stateProvince?.value,
        postalCode: ig.postalCode?.value,
        acceptingNewMembers: ig.acceptingNewMembers?.value,
        acceptsInitiatedVisitors: ig.acceptsInitiatedVisitors?.value,
        acceptsUninitiatedVisitors: ig.acceptsInitiatedVisitors?.value,
        isMixedGender: ig.mixedGender?.value === 1,
        mkpConnectContactUid: ig.contactUid?.value,
      }
      connectIGroups.push(connectIGroup)
    })

    return res.status(200).json({
      success: true,
      data: JSON.stringify(connectIGroups),
      count: connectIGroups.length,
    })
  } catch (e) {
    const networkInterfaces = os.networkInterfaces()
    const ipv4Address = Object.values(networkInterfaces)
      .flat()
      .find((iface) => iface?.family === "IPv4" && !iface.internal)?.address

    console.error(`Database query error from machine IP: ${ipv4Address}`, e)
    return res.status(500).json({
      success: false,
      error: "An error occurred while querying the database: " + e,
    })
  } finally {
    await prisma.$disconnect()
  }
}
