export default class {
  constructor(container) {
    this.container = container;
    this.channel = socket.channel("nodes", {});

    let updateNodes = msg => {
      this.update(msg.nodes);
    };

    this.channel.join().receive("ok", updateNodes);

    this.channel.on("update", updateNodes);

    let self = this;
    $(this.container).find("input").keypress(function (event) {
      if (event.keyCode === 13) { // enter key
        self.add(this.value.trim());
        this.value = "";
      }
    });
  }

  update(nodes) {
    let node_els = d3.select(this.container.find("ul").get(0)).selectAll("li.node_name").data(nodes);

    let self = this;

    let node = node_els.enter().insert("li")
          .attr("class", "node_name")
          .html(n => n)
          .on("click", function(d) {
            $(this).addClass("selected");
            $(this).siblings().removeClass("selected");
            self.visualizeNode(d);
          });

    node_els.exit().remove();
  }

  add(node) {
    this.channel.push("add", node);
  }

  visualizeNode(node) {
    this.channel.push("visualize", node);
  }
}
