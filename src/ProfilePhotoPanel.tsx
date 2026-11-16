import { useEffect, useRef, useState } from "react";

export default function ProfilePhotoPanel({
  photo,
  username,
  error,
}: {
  photo: string | null;
  username: string;
  error?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>();
  const [clientError, setClientError] = useState("");
  const [pending, setPending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const message = clientError || error;
  return (
    <aside className="profile-photo-panel" aria-label="Profile photo">
      <div className="profile-photo-preview">
        {preview || photo ? (
          <img
            src={preview || photo!}
            alt={preview ? "Selected photo preview" : "Your profile photo"}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="profile-photo-empty">
            <span>{username.slice(0, 2).toUpperCase()}</span>
            <p>A face to go with your name.</p>
          </div>
        )}
        {preview && (
          <span className="profile-preview-label">Preview · not saved yet</span>
        )}
      </div>
      <form
        className="profile-photo-controls"
        action="/profile/photo"
        method="post"
        encType="multipart/form-data"
        onSubmit={() => setPending(true)}
      >
        <h2>Your photo</h2>
        <p className="profile-photo-caption">
          Help other Niners recognize you.
        </p>
        <div className="profile-photo-picker">
          <label htmlFor="photo">
            {photo ? "Choose a new photo" : "Choose a photo"}
          </label>
          <input
            ref={input}
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            aria-describedby="photo-help photo-feedback"
            aria-invalid={message ? true : undefined}
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              setClientError("");
              if (
                chosen &&
                (chosen.size > 5 * 1024 * 1024 ||
                  (chosen.type &&
                    !["image/jpeg", "image/png", "image/webp"].includes(
                      chosen.type,
                    )))
              ) {
                setClientError("Choose a JPEG, PNG, or WebP up to 5 MB.");
                event.target.value = "";
                setFile(null);
                return;
              }
              setFile(chosen ?? null);
            }}
          />
        </div>
        {file && (
          <p className="profile-photo-filename" title={file.name}>
            {file.name}
          </p>
        )}
        <div className="profile-photo-actions">
          <button
            className="finder-btn finder-btn-primary"
            type="submit"
            disabled={pending}
          >
            {pending ? "Uploading…" : "Save photo"}
          </button>
          {file && (
            <button
              className="profile-photo-cancel"
              type="button"
              disabled={pending}
              onClick={() => {
                setFile(null);
                setClientError("");
                if (input.current) input.current.value = "";
              }}
            >
              Cancel
            </button>
          )}
        </div>
        <p id="photo-help" className="profile-photo-help">
          JPG, PNG or WebP · Max 5 MB
          <br />
          Still images up to 20 megapixels.
        </p>
        <p
          id="photo-feedback"
          className="field-error"
          role={message ? "alert" : undefined}
        >
          {message}
        </p>
      </form>
    </aside>
  );
}
