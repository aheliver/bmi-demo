"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"

import { AddFab } from "@/components/add-fab"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { computeBmi } from "@/lib/bmi"
import { useUnitSystem } from "@/providers/unit-system-provider"
import { createRecordSchema } from "@/features/records/schema"
import { useCreateRecord } from "@/features/records/api/hooks"

type FormInput = z.input<typeof createRecordSchema>
type FormOutput = z.output<typeof createRecordSchema>

export function AddRecordDialog() {
  const { system } = useUnitSystem()
  const [open, setOpen] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const { mutate, isPending } = useCreateRecord()

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createRecordSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dob: "",
      sex: undefined,
      system,
      weightValue: "",
      heightValue: "",
      phone: "",
      email: "",
    },
  })

  const weightLabel = system === "metric" ? "kg" : "lb"
  const heightLabel = system === "metric" ? "cm" : "in"

  const w = Number(watch("weightValue"))
  const h = Number(watch("heightValue"))
  const bmiPreview = w > 0 && h > 0 ? computeBmi({ weightValue: w, heightValue: h, system }) : null

  const handleOpenChange = (next: boolean) => {
    if (!next && isDirty) {
      setConfirmDiscard(true)
      return
    }
    setOpen(next)
  }

  const discard = () => {
    reset()
    setConfirmDiscard(false)
    setOpen(false)
  }

  const onSubmit = (data: FormOutput) => {
    mutate(
      { ...data, system },
      {
        onSuccess: () => {
          toast.success("Record added")
          reset()
          setOpen(false)
        },
        onError: () => {
          toast.error("Something went wrong, please try again later")
        },
      },
    )
  }

  return (
    <>
      <AddFab onClick={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add record</DialogTitle>
            <DialogDescription>Enter the participant&apos;s details.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                aria-invalid={errors.firstName ? true : undefined}
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-destructive text-sm">{errors.firstName.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                aria-invalid={errors.lastName ? true : undefined}
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-destructive text-sm">{errors.lastName.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                aria-invalid={errors.dob ? true : undefined}
                {...register("dob")}
              />
              {errors.dob && <p className="text-destructive text-sm">{errors.dob.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="sex">Sex</Label>
              <Controller
                control={control}
                name="sex"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger id="sex" className="w-full" aria-invalid={errors.sex ? true : undefined}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.sex && <p className="text-destructive text-sm">{errors.sex.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="weightValue">Weight ({weightLabel})</Label>
              <Input
                id="weightValue"
                type="number"
                step="any"
                aria-invalid={errors.weightValue ? true : undefined}
                {...register("weightValue")}
              />
              {errors.weightValue && (
                <p className="text-destructive text-sm">{errors.weightValue.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="heightValue">Height ({heightLabel})</Label>
              <Input
                id="heightValue"
                type="number"
                step="any"
                aria-invalid={errors.heightValue ? true : undefined}
                {...register("heightValue")}
              />
              {errors.heightValue && (
                <p className="text-destructive text-sm">{errors.heightValue.message}</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>BMI</Label>
              <output data-testid="bmi-preview" className="text-sm font-medium">
                {bmiPreview ?? "—"}
              </output>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                aria-invalid={errors.phone ? true : undefined}
                {...register("phone")}
              />
              {errors.phone && <p className="text-destructive text-sm">{errors.phone.message}</p>}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                aria-invalid={errors.email ? true : undefined}
                {...register("email")}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>Your entered data will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={discard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
