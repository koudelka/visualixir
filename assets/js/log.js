const MAX_LOG_LINES = 100;

class OnePid {
  constructor(pid, type) {
    this.pid = pid.name;
    this.type = type;

    switch (type) {
      case "spawn":
        this.verb = "spawned";
        break;
      case "exit":
        this.verb = "exited";
        break;
    }
  }

  toHTML() {
    return '<span class="pid"> ' + this.pid + " </span> " +
           '<span class="verb">' + this.verb + "</span> ";
  }
}

class TwoPid {
  constructor(from_pid, to_pid, type) {
    this.from_pid = from_pid.name;
    this.to_pid = to_pid.name;
    this.type = type;

    switch (type) {
     case "link":
       this.verb = "linked with";
       break;
     case "unlink":
       this.verb = "unlinked from";
       break;
     }
  }

  toHTML() {
    return '<span class="pid from"> ' + this.from_pid + " </span> " +
           '<span class="verb">' + this.verb + "</span> " +
           '<span class="pid to"> ' + this.to_pid + " </span> ";
  }
}

class Msg extends TwoPid {
  constructor(from_pid, to_pid, msg) {
    super(from_pid, to_pid);

    this.msg = msg;
    this.verb = "sent";
    this.type = "msg";
  }

  toHTML() {
    return super.toHTML() +
           '<span class="verb"> the message </span>' +
           '<span class="msg"> ' + this.msg + " </span> ";
  }
}


export default class {
  constructor(container) {
    this.container = d3.select(container.get(0));
    this.lines = [];
  }

  logMsgLine(from_pid, to_pid, msg) { this.addLine(new Msg(from_pid, to_pid, msg)); }
  logOnePidLine(pid, type) { this.addLine(new OnePid(pid, type)); }
  logTwoPidLine(pid, other_pid, type) { this.addLine(new TwoPid(pid, other_pid, type)); }

  addLine(line) {
    line.id = new Date().getTime() + "" + Math.random() + "" + Math.random();
    this.lines.unshift(line);
    this.lines = this.lines.splice(0, MAX_LOG_LINES+1);
    this.update();
  }

  update() {
    let line_els = this.container.selectAll("div.logline").data(this.lines, d => d.id);

    line_els.exit().remove();

    let line = line_els.enter().insert("div", ":first-child")
          .attr("class", l => "logline " + l.type)
          .html(l => '<img src="/images/' + l.type + '.png">' + l.toHTML());

    line_els.merge(line);
  }
}
