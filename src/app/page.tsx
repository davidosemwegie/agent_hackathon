"use client";

import { SetUserForm } from "@/components/set-user-form/set-user-form";
import { Actor } from "../../director";

export default function Home() {
  const actor = new Actor();

  const handleClick = () => {
    actor.type('input[name="firstName"]', "John", false);
    actor.type('input[name="lastName"]', "Doe", false);
    actor.click('button[data-intent="settings.update-name.actions.update"]');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <SetUserForm />
      <button onClick={handleClick}>Click me</button>
    </div>
  );
}
