import { submitConfession } from '../../commands/Community/confession.js';

export default {
  name: 'confession_submit',
  async execute(interaction, client) {
    await submitConfession(interaction, client);
  },
};
