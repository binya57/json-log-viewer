import './components/Form.tsx';
import { isValidElement } from "react";
import { renderToStaticMarkup } from 'react-dom/server';
import Table, { type NestedRow } from './components/Table.tsx';
import Form from './components/Form.tsx';
import type { Server } from 'bun';
import htmlLayoutFile from "./index.html" with { type: "text" };
import { watch } from "fs";


const server = Bun.serve({
    async fetch(req, server) {
        try {
            return await handleHttpRequest(req, server);
        } catch (error) {
            console.error(error);
            return new Response("Internal Server Error", { status: 500 });
        }
    },



    websocket: {
        // this is called when a message is received
        async message(ws, message) {
            console.log(`Received ${message}`);
            // send back a message
            ws.send(`You said: ${message}`);
        },
        // a socket is opened
        open(ws) {
        },
        // a socket is closed
        close(ws, code, message) { },
        // the socket is ready to receive more data
        drain(ws) { },

    },
});

async function handleHttpRequest(req: Request, server: Server) {
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
        if (!fileOrFolderPath) throw new Error('no file or folder path provided');
        const jsonObjects = await getFileAsJsonObjectsArray(fileOrFolderPath?.toString() ?? '');
        return new Response(layout(renderJsxToHtml(<Table rows={jsonObjects} />)), { headers: { "Content-Type": "text/html" } });
    }
    return new Response(layout(renderJsxToHtml(<Form />)), { headers: { "Content-Type": "text/html" } });
}

const decoder = new TextDecoder();
async function getFileAsJsonObjectsArray(path: string) {
    if (!path) {
        throw new Error("invalid path");
    }
    const file = Bun.file(path);
    const watcher = watch(path, (event, filename) => {
        if (event !== 'change') return;
        console.log(`Detected ${event} in ${filename}`);
    });

    process.on("SIGINT", () => {
        // close watcher when Ctrl-C is pressed
        console.log("Closing watcher...");
        watcher.close();

        process.exit(0);
    });

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

const css = await Bun.file('./index.css').text();

function layout(html: string) {
    const withLayout = htmlLayoutFile.replace('{html}', html).replace('{css}', `<style>${css}</style>`);
    return (
        withLayout
    )
}

const renderJsxToHtml = (jsx: JSX.Element) => {
    return renderToStaticMarkup(jsx);
}


console.log(`Listening on http://${server.hostname}:${server.port}`);
