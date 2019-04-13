const FADE_TIME = 2000, // msec
      MAX_MSG_LENGTH = 60,
      MAX_PID_LENGTH = 30;

var nextMessageSequenceID = 1;

export default class {
  constructor(svg) {
    this.id = nextMessageSequenceID++;
    this.svg = svg;
    this.msg_seq = d3.messageSequence().fade(FADE_TIME);

    this.svg.node().msg_seq = this;

    this.svg
      .append("rect")
      .attr("class", "background")
      .attr("width", "100%")
      .attr("height", "100%");

    this.svg.call(this.msg_seq);
  }

  addMessage(msg) {
    let text = msg.message,
        from = msg.source.qualifiedName(),
        to = msg.target.qualifiedName();

    if (text.length > MAX_MSG_LENGTH)
      text = text.slice(0, MAX_MSG_LENGTH-1) + " ...";

    if (from.length > MAX_PID_LENGTH)
      from = from.slice(0, MAX_PID_LENGTH-1) + "...";

    if (to.length > MAX_PID_LENGTH)
      to = to.slice(0, MAX_PID_LENGTH-1) + "...";

    this.msg_seq.addMessage({from: from, to: to, msg: text});
  }
}
