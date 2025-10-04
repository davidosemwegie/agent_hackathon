"use client";

import { SetUserForm } from "@/components/set-user-form/set-user-form";
import { Actor } from "../../director";

export default function Home() {
  const actor = new Actor();

  const handleClick = async () => {
    await actor.type(
      'input[data-intent="settings.update-name.fields.firstName"]',
      "John"
    );
    await actor.type(
      'input[data-intent="settings.update-name.fields.lastName"]',
      "Doe"
    );
    await actor.click(
      'button[data-intent="settings.update-name.actions.submit"]'
    );
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <SetUserForm />
      <button onClick={handleClick}>Click me</button>
    </div>
  );
}
