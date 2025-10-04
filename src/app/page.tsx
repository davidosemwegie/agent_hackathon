"use client";

export default function Home() {
  const handleClick = () => {
    console.log("Button clicked");
  };

  return (
    <div>
      <h1>Hello World</h1>
      <button onClick={handleClick}>Click me</button>
    </div>
  );
}
