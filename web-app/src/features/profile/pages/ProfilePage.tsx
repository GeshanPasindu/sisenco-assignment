import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { applyFormErrors } from "../../auth/components/form-errors";
import { FormFeedback } from "../../auth/components/FormFeedback";
import { FormField } from "../../auth/components/FormField";
import {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from "../api/profileApi";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(100),
  lastName: z.string().trim().min(1, "Enter your last name.").max(100),
  personalEmail: z.union([
    z.string().trim().email("Enter a valid email address."),
    z.literal(""),
  ]),
  contactNumber: z.string().trim().max(30),
  addressLine1: z.string().trim().max(255),
  addressLine2: z.string().trim().max(255),
  city: z.string().trim().max(100),
  postalCode: z.string().trim().max(20),
});
type Values = z.infer<typeof schema>;

export function ProfilePage() {
  const { data, isLoading, isError, refetch } = useGetMyProfileQuery();
  const [update, { isLoading: saving }] = useUpdateMyProfileMutation();
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      personalEmail: "",
      contactNumber: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      postalCode: "",
    },
  });
  useEffect(() => {
    if (data) {
      const profile = data.data;
      reset({
        firstName: profile.firstName,
        lastName: profile.lastName,
        personalEmail: profile.personalEmail ?? "",
        contactNumber: profile.contactNumber ?? "",
        addressLine1: profile.addressLine1 ?? "",
        addressLine2: profile.addressLine2 ?? "",
        city: profile.city ?? "",
        postalCode: profile.postalCode ?? "",
      });
    }
  }, [data, reset]);
  if (isLoading)
    return <p className="text-sm text-slate-500">Loading profile…</p>;
  if (isError || !data)
    return (
      <div className="form-feedback-error p-4 text-sm">
        Could not load your profile.{" "}
        <button
          type="button"
          className="font-medium underline"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  const profile = data.data;
  return (
    <section className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">My profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Keep your personal contact details up to date.
        </p>
      </div>
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            const result = await update({
              ...values,
              personalEmail: values.personalEmail || null,
              contactNumber: values.contactNumber || null,
              addressLine1: values.addressLine1 || null,
              addressLine2: values.addressLine2 || null,
              city: values.city || null,
              postalCode: values.postalCode || null,
            }).unwrap();
            const updated = result.data;
            reset({
              firstName: updated.firstName,
              lastName: updated.lastName,
              personalEmail: updated.personalEmail ?? "",
              contactNumber: updated.contactNumber ?? "",
              addressLine1: updated.addressLine1 ?? "",
              addressLine2: updated.addressLine2 ?? "",
              city: updated.city ?? "",
              postalCode: updated.postalCode ?? "",
            });
            setSaved(true);
          } catch (error) {
            setSaved(false);
            applyFormErrors(error, setError, [
              "firstName",
              "lastName",
              "personalEmail",
              "contactNumber",
              "addressLine1",
              "addressLine2",
              "city",
              "postalCode",
            ]);
          }
        })}
        className="rounded-md border border-slate-200 bg-white p-5 sm:p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="First name"
            {...register("firstName")}
            error={errors.firstName?.message}
            required
          />
          <FormField
            label="Last name"
            {...register("lastName")}
            error={errors.lastName?.message}
            required
          />
          <FormField label="Company email" value={profile.email} readOnly />
          <FormField label="Employee ID" value={profile.employeeId} readOnly />
          <FormField label="Role" value={profile.role.name} readOnly />
          <FormField
            label="Account status"
            value={profile.accountStatus}
            readOnly
          />
          <FormField
            label="Personal email"
            type="email"
            {...register("personalEmail")}
            error={errors.personalEmail?.message}
          />
          <FormField
            label="Contact number"
            {...register("contactNumber")}
            error={errors.contactNumber?.message}
          />
          <FormField
            label="Address line 1"
            {...register("addressLine1")}
            error={errors.addressLine1?.message}
          />
          <FormField
            label="Address line 2"
            {...register("addressLine2")}
            error={errors.addressLine2?.message}
          />
          <FormField
            label="City"
            {...register("city")}
            error={errors.city?.message}
          />
          <FormField
            label="Postal code"
            {...register("postalCode")}
            error={errors.postalCode?.message}
          />
        </div>
        {errors.root?.server?.message && (
          <div className="mt-4">
            <FormFeedback>{errors.root.server.message}</FormFeedback>
          </div>
        )}
        {saved && (
          <div className="mt-4">
            <FormFeedback tone="success">
              Your profile has been updated.
            </FormFeedback>
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="button-primary mt-6 px-4"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </section>
  );
}
