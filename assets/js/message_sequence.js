const FADE_TIME = 2000, // msec
      MAX_MSG_LENGTH = 60,
      MAX_PID_LENGTH = 30;

export default class {
  constructor(container) {
    this.container = d3.select(container.get(0));
    this.msg_seq = d3.messageSequence().fade(FADE_TIME);

    this.container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .call(this.msg_seq);
  }

  addMessage(from, to, msg) {
    let from_name = from.name,
        to_name = to.name;

    if (msg.length > MAX_MSG_LENGTH)
      msg = msg.slice(0, MAX_MSG_LENGTH-1) + " ...";

    if (from_name.length > MAX_PID_LENGTH)
      from_name = from_name.slice(0, MAX_PID_LENGTH-1) + "...";

    if (to_name.length > MAX_PID_LENGTH)
      to_name = to_name.slice(0, MAX_PID_LENGTH-1) + "...";

    this.msg_seq.addMessage({from: from_name, to: to_name, msg: msg});
  }
}
