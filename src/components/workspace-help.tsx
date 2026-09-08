import { FileText, FolderClosed, Sun, Users } from "lucide-react";
import { Dialog } from "./dialog";

export function WorkspaceHelp({
  modifier,
  onClose,
}: {
  modifier: string;
  onClose: () => void;
}) {
  return (
    <Dialog title="Help" onClose={onClose}>
      <div className="help-content">
        <h3>Keyboard shortcuts</h3>
        <p>
          <span>Search</span>
          <kbd>{modifier} K</kbd>
        </p>
        <p>
          <span>New task</span>
          <kbd>Shift N / N</kbd>
        </p>
        <p>
          <span>Open this guide</span>
          <kbd>?</kbd>
        </p>
        <p>
          <span>Close a dialog</span>
          <kbd>Esc</kbd>
        </p>
        <hr />
        <h3>Using OpenCadence</h3>
        <ul className="help-guide" role="list" aria-label="Using OpenCadence">
          <li>
            <span className="help-guide-icon" aria-hidden="true">
              <Sun size={17} strokeWidth={1.7} />
            </span>
            <div>
              <h4>Today</h4>
              <p>
                See tasks due today or overdue, alongside scheduled client
                follow-ups.
              </p>
            </div>
          </li>
          <li>
            <span className="help-guide-icon" aria-hidden="true">
              <FolderClosed size={17} strokeWidth={1.7} />
            </span>
            <div>
              <h4>Projects</h4>
              <p>
                Open a project to manage its tasks and notes, see progress, and
                edit its details.
              </p>
            </div>
          </li>
          <li>
            <span className="help-guide-icon" aria-hidden="true">
              <Users size={17} strokeWidth={1.7} />
            </span>
            <div>
              <h4>Clients</h4>
              <p>
                Open a client to update their pipeline stage, record an
                interaction, or set a follow-up date.
              </p>
            </div>
          </li>
          <li>
            <span className="help-guide-icon" aria-hidden="true">
              <FileText size={17} strokeWidth={1.7} />
            </span>
            <div>
              <h4>Notes</h4>
              <p>
                Keep notes on their own or link them to a project or client.
                Save your changes before closing.
              </p>
            </div>
          </li>
        </ul>
        <div className="local-help">
          <span className="dot green" />
          <p>
            Data is saved on the computer running OpenCadence. There’s no cloud
            sync, and logging an email doesn’t send it. OpenCadence Community is
            a single-user workspace; keep it off the public internet.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
