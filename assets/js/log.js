const MAX_LOG_LINES = 100;

class OneProcess {
  constructor(process, type) {
    this.process = process;
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
    return '<span class="pid"> ' + this.process.name + " </span>" +
           '<span class="verb">' + this.verb + "</span> on " +
           '<span class="pid"> ' + this.process.node + " </span> ";
  }
}

class TwoProcess {
  constructor(from_process, to_process, type) {
    this.from_process = from_process;
    this.to_process = to_process;
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
    let lines;

    if (this.from_process.node == this.to_process.node) {
      lines = ['<span class="pid from">' + this.from_process.name + "</span> "];
    } else {
      lines = ['<span class="pid from">' + this.from_process.name + "</span> on ",
               '<span class="pid from">' + this.from_process.node + "</span> "];
    }

    return lines.concat([
      '<span class="verb">' + this.verb + "</span> ",
      '<span class="pid to">' + this.to_process.name + "</span> on ",
      '<span class="pid to">' + this.to_process.node + "</span> "
    ]).join("");
  }
}

class Msg extends TwoProcess {
  constructor(from_process, to_process, msg) {
    super(from_process, to_process);

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

  logMsgLine(from_process, to_process, msg) { this.addLine(new Msg(from_process, to_process, msg)); }
  logOneProcessLine(process, type) { this.addLine(new OneProcess(process, type)); }
  logTwoProcessLine(process, other_process, type) { this.addLine(new TwoProcess(process, other_process, type)); }

  addLine(line) {
    line.id = new Date().getTime() + "" + Math.random() + "" + Math.random();
    this.lines.unshift(line);
    this.lines = this.lines.splice(0, MAX_LOG_LINES+1);
    this.update();
  }

  update() {
    let line_els = this.container.selectAll("div.logline").data(this.lines, d => d.id);

    line_els.exit().remove();

    let line =
        line_els.enter()
        .insert("div", ":first-child")
        .attr("class", l => "logline " + l.type)
        .html(l => '<img src="/images/' + l.type + '.png">' + l.toHTML());

    line_els.merge(line);
  }
}
