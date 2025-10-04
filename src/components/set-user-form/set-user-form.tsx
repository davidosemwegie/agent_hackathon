"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  Form,
} from "../ui/form";
import { Input } from "../ui/input";

const formSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export function SetUserForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    alert("Form submitted with values: " + JSON.stringify(values));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input
                  placeholder="First Name"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                  data-intent="settings.update-name.fields.firstName"
                />
              </FormControl>
              <FormDescription>
                This is your public display name.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Last Name"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value)}
                  data-intent="settings.update-name.fields.lastName"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button data-intent="settings.update-name.actions.submit" type="submit">
          Submit
        </Button>
      </form>
    </Form>
  );
}
