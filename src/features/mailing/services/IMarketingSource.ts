/** A registered gym, as the mailing list sees it. */
export interface GymOwnerRecipient {
  gymId: string
  email: string
  gymName: string
}

/** A demo request whose sender ticked the marketing consent box. */
export interface ConsentingLeadRecipient {
  email: string
  name: string
  gymName: string | null
}

/** Where the people on the mailing list come from (the app's own tables). */
export interface IMarketingSource {
  listGymOwners(): Promise<GymOwnerRecipient[]>
  listConsentingLeads(): Promise<ConsentingLeadRecipient[]>
}
