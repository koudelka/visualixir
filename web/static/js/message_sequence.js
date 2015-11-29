const fade_time = 4000, // msec
      max_msg_length = 60,
      max_pid_length = 30;

export default class {
  constructor(container) {
    this.container = d3.select(container.get(0));
    this.msg_seq = d3.messageSequence().fade(fade_time);

    this.container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .call(this.msg_seq);
  }

  addMessage(from_pid, to_pid, msg) {
    var from = from_pid.name || from_pid.id,
        to = to_pid.name || to_pid.id;

    if (msg.length > max_msg_length)
      msg = msg.slice(0, max_msg_length-1) + " ...";

    if (from.length > max_pid_length)
      from = from.slice(0, max_pid_length-1) + "...";

    if (to.length > max_pid_length)
      to = to.slice(0, max_pid_length-1) + "...";

    this.msg_seq.addMessage({from: from, to: to, msg: msg});
  }
}
