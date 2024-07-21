
type RowValues = string | null | string | number
type Row = Record<string, RowValues>

export type NestedRow = Record<string, RowValues | Row>

type TableProps = {
    rows: NestedRow[]
}

export default function Table({ rows }: TableProps) {


    const headers = Object.keys(rows[0]);

    function getContent(key: string, value: NestedRow[string]) {
        if (value === null)
            return '';

        if (typeof value !== 'object')
            return value;

        return getAsList(key, value);
    }

    function getAsList(key: string, obj: Row) {
        return (
            <details>
                <summary>{key}</summary>
                <ul>
                    {
                        Object.keys(obj).map((prop, index) => {
                            return (
                                <li key={index}>
                                    <span style={{ fontWeight: 'bold' }}>{key}.{prop}</span>
                                    <>{getContent(prop, obj[prop])}</>
                                </li>
                            )
                        })
                    }
                </ul>
            </details>
        )
    }

    return (
        <table>
            <thead>
                {
                    headers.map((header, index) => (
                        <th key={index}>{header}</th>
                    ))
                }
            </thead>
            <tbody>
                {
                    rows.map((row) => (
                        <tr>
                            {
                                headers.map((header, index) => {
                                    const value = row[header];
                                    return (
                                        <td key={index}>{getContent(header, value)}</td>
                                    )
                                })
                            }
                        </tr>
                    ))
                }
            </tbody>
        </table>
    )
}