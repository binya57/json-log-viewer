const ws = new WebSocket('ws://localhost:3000');
ws.onmessage = (event) => {
    const newRow = event.data;
    document.querySelector('table').innerHTML += newRow;
}
