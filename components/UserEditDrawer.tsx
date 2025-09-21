"use client";

import { useEffect, useState } from "react";
import { UserRow, Role, Status } from "@/types/user";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
  user: UserRow | null;
  onSave: (u: UserRow) => void;
}

const ROLES: Role[] = ["ADMIN", "STAFF", "PROFESSOR"];
const STATUSES: Status[] = ["ACTIVE", "SUSPENDED"];

export default function UserEditDrawer({ open, onClose, user, onSave }: Props) {
  const [draft, setDraft] = useState<UserRow | null>(null);

  useEffect(() => {
    setDraft(user);
  }, [user]);

  if (!draft) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-semibold text-lg">แก้ไขผู้ใช้</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-sm text-gray-600">Username</label>
              <input className="w-full border rounded-lg px-3 py-2"
                value={draft.username}
                onChange={e => setDraft({ ...draft, username: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-600">ชื่อ</label>
                <input className="w-full border rounded-lg px-3 py-2"
                  value={draft.first_name}
                  onChange={e => setDraft({ ...draft, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">นามสกุล</label>
                <input className="w-full border rounded-lg px-3 py-2"
                  value={draft.last_name}
                  onChange={e => setDraft({ ...draft, last_name: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600">อีเมล</label>
              <input className="w-full border rounded-lg px-3 py-2"
                value={draft.email ?? ""}
                onChange={e => setDraft({ ...draft, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">เบอร์โทร</label>
              <input className="w-full border rounded-lg px-3 py-2"
                value={draft.phone ?? ""}
                onChange={e => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-600">ตำแหน่ง</label>
              <input className="w-full border rounded-lg px-3 py-2"
                value={draft.position ?? ""}
                onChange={e => setDraft({ ...draft, position: e.target.value })}
              />
            </div>

            {/* Role */}
            <div>
              <label className="text-sm text-gray-600">บทบาท</label>
              <div className="flex gap-2 mt-1">
                {ROLES.map(r => (
                  <button key={r}
                    onClick={() => setDraft({ ...draft, role: r })}
                    className={`px-3 py-1 rounded-lg border text-sm ${draft.role === r
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-700 border-gray-200"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-sm text-gray-600">สถานะ</label>
              <div className="flex gap-2 mt-1">
                {STATUSES.map(s => (
                  <button key={s}
                    onClick={() => setDraft({ ...draft, status: s })}
                    className={`px-3 py-1 rounded-lg border text-sm ${draft.status === s
                      ? (s === "ACTIVE"
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-red-500 text-white border-red-500")
                      : "bg-gray-50 text-gray-700 border-gray-200"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <button
              onClick={() => { onSave(draft); onClose(); }}
              className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition"
            >
              บันทึกการเปลี่ยนแปลง
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}