import { handleLookup } from "./_lib/approval.js";

export default {
  async fetch(request) {
    return handleLookup(request);
  },
};
