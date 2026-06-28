import { handleRoot } from "./_lib/approval.js";

export default {
  async fetch(request) {
    return handleRoot(request);
  },
};
