class Terminal {
    
  init(total = 100, width = 30) {
    this.total = total;
    this.width = width;
    this.current = 0;
    this.titl
  }

  update(title, value) {
    this.current = Math.min(value, this.total);
    const percent = this.current / this.total;
    const filledLength = Math.round(this.width * percent);
    const bar = '█'.repeat(filledLength) + '-'.repeat(this.width - filledLength);
    const percentText = (percent * 100).toFixed(1).padStart(5, ' ');

    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${title} [${bar}] ${percentText}% `);
  }

  finish() {
    process.stdout.write('\n');
  }
}

export default new Terminal();