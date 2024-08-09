import { FILE_NAME_KEY } from "../index";

export default function Form() {
    return (
        <div className="root">
            <form method="post" action="http://localhost:3000" id="form">
                <label htmlFor={FILE_NAME_KEY}>Enter File or Folder</label>
                <input type="text" name={FILE_NAME_KEY} id={FILE_NAME_KEY} required autoComplete="on" />
                <input type="submit" value="Submit" />
            </form>
        </div>
    )
}