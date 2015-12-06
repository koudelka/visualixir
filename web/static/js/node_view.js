import Graph from "web/static/js/graph";
import MessageSequence from "web/static/js/message_sequence";
import Log from "web/static/js/log";

export default class {
  constructor(node, graph_container, msg_seq_container, log_container) {
    this.node = node;
    this.channel = socket.channel("trace:"+ node, {});
    this.pids = {};

    graph_container.empty();
    msg_seq_container.empty();
    log_container.empty();

    this.graph = new Graph(graph_container, this, this.pids);
    this.msg_seq = new MessageSequence(msg_seq_container);
    this.logger = new Log(log_container);

    this.channel.on("spawn", msg => {
      $.each(msg, (pid, info) => {
        this.addNode(pid, info);
        this.logger.logOnePidLine(this.pids[pid], "spawn");
      });
      this.graph.update(true);
    });

    this.channel.on("exit", msg => {
      if (this.pids[msg.pid]) {
        this.logger.logOnePidLine(this.pids[msg.pid], "exit");
        this.removeNode(msg.pid);
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

      if (from && to ) {
        this.logger.logMsgLine(from, to, msg.msg);
        this.msg_seq.addMessage(from, to, msg.msg);
      }

      this.graph.update(false);
    });

    this.channel.join().receive("ok", msg => {
      $.each(msg.pids, (pid, info) => this.addNode(pid, info));
      $.each(msg.ports, (port, info) => this.addNode(port, info));
      msg.links.forEach(link => this.graph.addLink(link[0], link[1]));
      this.graph.update(true);
    });
  }

  addNode(id, info) {
    let pid = {"id": id,
               links: {},
               name: info.name,
               application: info.application,
               type: info.type,
               msg_traced: info.msg_traced};
    this.pids[id] = pid;
  }

  removeNode(id) {
    if(!this.pids[id]) return;

    this.graph.removeNode(this.pids[id]);

    delete this.pids[id];
  }


  msgTracePID(pid) {
    this.channel.push("msg_trace", pid);
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
