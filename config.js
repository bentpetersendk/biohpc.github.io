const siteConfig = {
  urls: {
    biohpcStats: "https://raw.githubusercontent.com/bentpetersendk/dashboard-data/main/biohpc/stats.json",
    piRegistrationForm: "https://airtable.com/appQsnn57Oi8vNAWD/pag2HvrNw52AfY3q9/form",
    projectSpaceRequestForm: "https://airtable.com/appQsnn57Oi8vNAWD/pagKILRMZ6p0ek9Vc/form",
    userRequestForm: "https://airtable.com/appQsnn57Oi8vNAWD/pagW96PfyUrhBkk49/form",
    projectMembershipRequestForm: "https://airtable.com/appQsnn57Oi8vNAWD/pagLehE3XS1JPTLKa/form",
    documentation: "https://rubus.ku.dk/",
    support: "mailto:biohpc@ku.dk"
  },
  approvals: {
    supportEmail: "biohpc@ku.dk",
    requestTypes: {
      membership: {
        label: "Project Membership Request",
        successVerb: "approved",
        rejectionVerb: "rejected",
        lookupPayloadType: "membership",
        decisionPayloadType: "membership"
      }
    },
    endpoints: {
      lookup: "https://biohpc-github-io.vercel.app/lookup",
      decision: "https://biohpc-github-io.vercel.app/decision"
    },
    messages: {
      invalidLink: "Invalid approval link.",
      expiredLink: "This approval link has expired.",
      requestUnavailable: "We could not retrieve this approval request right now.",
      decisionUnavailable: "We could not submit your decision right now.",
      processedPrefix: "This request has already been",
      noFurtherAction: "No further action is required."
    }
  },
  contact: {
    email: "biohpc@ku.dk",
    emailHref: "mailto:biohpc@ku.dk",
    phone: "",
    organization: "BioHPC, Department of Biology, University of Copenhagen"
  },
  pricing: {
    cpuAccounting: "CPU usage is accounted per Project Space based on scheduled compute activity.",
    memoryAccounting: "Memory usage is tracked with job activity so resource use can be understood at project level.",
    resourceAllocation: "Project Spaces organize project storage, membership, accounting, and access to shared compute resources that can be reviewed as research needs change.",
    costRecovery: "BioHPC follows a cost-recovery model for sustainable operation of shared research computing resources for Department of Biology employees.",
    note: "Current pricing and resource usage details are maintained in the Rubus documentation."
  }
};
