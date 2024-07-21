import './components/Form.tsx';
import { isValidElement } from "react";
import { renderToStaticMarkup } from 'react-dom/server';
import Table, { type NestedRow } from './components/Table.tsx';
import Form from './components/Form.tsx';

const server = Bun.serve({
    async fetch(req, server) {
        const success = server.upgrade(req);
        if (success) {
            // Bun automatically returns a 101 Switching Protocols
            // if the upgrade succeeds
            return undefined;
        }

        // handle HTTP request normally
        if (req.method === 'POST') {
            const formData = await req.formData();
            const fileOrFolderPath = formData.get('file_or_folder');
            const jsonObjects = await getAsJsonObjectsArray(fileOrFolderPath?.toString() ?? '');
            // const html = createHtml(jsonObjects);
            // return new Response(Bun.file('./jsonl-log-reader.html'));
            return new Response(layout(createHtml(<Table rows={jsonObjects} />)), { headers: { "Content-Type": "text/html" } });
        }
        return new Response(layout(createHtml(<Form />)), { headers: { "Content-Type": "text/html" } });
    },



    websocket: {
        // this is called when a message is received
        async message(ws, message) {
            console.log(`Received ${message}`);
            // send back a message
            ws.send(`You said: ${message}`);
        },
        // a socket is opened
        open(ws) { },
        // a socket is closed
        close(ws, code, message) { },
        // the socket is ready to receive more data
        drain(ws) { },

    },
});

const decoder = new TextDecoder();
async function getAsJsonObjectsArray(path: string) {
    if (!path) {
        throw new Error("invalid path");
    }
    const file = Bun.file(path);
    const stream = file.stream();
    let remainingData = "";
    const jsonObjects: NestedRow[] = [];
    for await (const chunk of stream) {
        const str = decoder.decode(chunk);
        remainingData += str; // Append the chunk to the remaining data
        // Split the remaining data by newline character
        let lines = remainingData.split(/\r?\n/);
        // Loop through each line, except the last one
        while (lines.length > 1) {
            // Remove the first line from the array and pass it to the callback
            const line = lines.shift();
            jsonObjects.push(JSON.parse(line || "{}"));
        }
        // Update the remaining data with the last incomplete line
        remainingData = lines[0];
    }
    return jsonObjects;
}
const css = Bun.file('./main.css').text();

function createHtml(jsx: JSX.Element) {
    return renderJsxToHtml(jsx);
}

const htmlLayoutFile = await Bun.file('./index.html').text();

function layout(html: string) {
    const withLayout = htmlLayoutFile.replace('{html}', html)
    return (
        withLayout
    )
}

const renderJsxToHtml = (jsx: JSX.Element) => {
    return renderToStaticMarkup(jsx);
}

function addCss(html: string, css: string) {
    const rewriter = new HTMLRewriter();
    rewriter.on('head', {
        element(head) {
            head.append(`<style>${css}</style>`);
        }
    })
    rewriter.on("body", {
        element(body) {

        },
    });
}

console.log(`Listening on ${server.hostname}:${server.port}`);