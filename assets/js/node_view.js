import Graph from "./graph.js";
import MessageSequence from "./message_sequence.js";
import Log from "./log.js";

export default class {
  constructor(graph_container, msg_seq_container, log_container) {
    this.channels = {};
    this.pids = {};

    graph_container.empty();
    msg_seq_container.empty();
    log_container.empty();

    this.graph = new Graph(graph_container, this, this.pids);
    this.msg_seq = new MessageSequence(msg_seq_container);
    this.logger = new Log(log_container);

  }

  addNode(node) {
    this.channel = window.socket.channel("trace", {node: node});

    this.channel.join().receive("ok", msg => {
      $.each(msg.pids, (pid, info) => {this.addProcess(pid, info);});
      $.each(msg.ports, (port, info) => this.addProcess(port, info));
      msg.links.forEach(link => this.graph.addLink(link[0], link[1]));
      this.graph.update(true);
    });

    this.channel.on("spawn", msg => {
      $.each(msg, (pid, info) => {
        this.addProcess(pid, info);
        this.logger.logOnePidLine(this.pids[pid], "spawn");
      });
      this.graph.update(true);
    });

    this.channel.on("exit", msg => {
      if (this.pids[msg.pid]) {
        this.logger.logOnePidLine(this.pids[msg.pid], "exit");
        this.removeProcess(msg.pid);
        this.graph.update(true);
      }
    });

    this.channel.on("name", msg => {
      this.graph.updateName(msg.pid, msg.name);
    });

    this.channel.on("links", msg => {
      msg.links.forEach(link => {
        this.graph.addLink(link[0], link[1]);

        var from = this.pids[link[0]],
            to = this.pids[1];

        if (from && to) {
          this.logger.logTwoPidLine(from, to, "link");
        }
      });
      this.graph.update(true);
    });

    this.channel.on("unlink", msg => {
      this.graph.removeLink(msg.link[0], msg.link[1]);
      this.logger.logTwoPidLine(this.pids[msg.link[0]], this.pids[msg.link[1]], "unlink");
      this.graph.update(true);
    });

    this.channel.on("msg", msg => {
      this.graph.addMsg(msg.from_pid, msg.to_pid);

      var from = this.pids[msg.from_pid],
          to = this.pids[msg.to_pid];

      if (from && to) {
        this.logger.logMsgLine(from, to, msg.msg);
        this.msg_seq.addMessage(from, to, msg.msg);
      }

      this.graph.update(false);
    });

  }

  addProcess(id, info) {
    let pid = {"id": id,
               links: {},
               local_pid: info.local_pid,
               name: info.name,
               node: info.node,
               application: info.application,
               type: info.type,
               msg_traced: info.msg_traced};
    this.pids[id] = pid;
  }

  removeProcess(id) {
    if(!this.pids[id]) return;

    this.graph.removeNode(this.pids[id]);

    delete this.pids[id];
  }

  msgTracePID(id) {
    this.channel.push("msg_trace", id);
  }

  stopMsgTraceAll(node) {
    this.channel.push("stop_msg_trace_all", node);
    this.graph.stopMsgTraceAll();
    this.graph.update(false);
  }

  cleanup() {
    this.channel.leave();
  }

}
