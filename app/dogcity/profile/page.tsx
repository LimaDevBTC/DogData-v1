"use client"

// /dogcity/profile (servida em dogcity.space/profile): o mesmo corpo do perfil do dogdata.xyz, com a moldura da cidade.
import { CityLayout } from "../city-layout"
import { ProfileBody } from "@/components/profile/profile-body"

export default function DogCityProfilePage() {
  return <ProfileBody Shell={CityLayout} />
}
