import createTicketHandler, {
  closeTicketHandler,
  claimTicketHandler,
  pinTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler,
  transcriptTicketHandler,
} from '../../../handlers/ticketButtons.js';

export default [
  createTicketHandler,
  closeTicketHandler,
  claimTicketHandler,
  pinTicketHandler,
  unclaimTicketHandler,
  reopenTicketHandler,
  deleteTicketHandler,
  transcriptTicketHandler,
];